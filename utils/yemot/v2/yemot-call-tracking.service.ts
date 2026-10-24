import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { Call } from 'yemot-router2';
import { User } from '@shared/entities/User.entity';
import { YemotCall } from '@shared/entities/YemotCall.entity';

@Injectable()
export class YemotCallTrackingService {
  private readonly logger = new Logger(YemotCallTrackingService.name);
  private activeCalls = new Map<string, YemotCall>();

  constructor(
    @InjectDataSource() private dataSource: DataSource,
  ) { }

  /**
   * Find active call - tries cache first, then database
   */
  private async findActiveCall(callId: string): Promise<YemotCall | null> {
    if (!callId) {
      return null;
    }

    // Try to get from active calls cache first
    let yemotCallRecord = this.activeCalls.get(callId);
    
    // If not in cache, query database
    if (!yemotCallRecord) {
      yemotCallRecord = await this.dataSource.getRepository(YemotCall).findOne({
        where: { apiCallId: callId }
      });
      
      // Add to cache if found
      if (yemotCallRecord) {
        this.activeCalls.set(callId, yemotCallRecord);
      }
    }

    return yemotCallRecord;
  }

  /**
   * Initialize call tracking when a new call starts (or load the existing row on a
   * later request of the call). Returns the call row, if the call has one.
   */
  async initializeCall(call: Call): Promise<YemotCall | null> {
    try {
      if (!call.callId || !call.did) {
        this.logger.warn('Cannot initialize call tracking: missing callId or did');
        return null;
      }

      // Check if call already exists
      const existingCall = await this.dataSource.getRepository(YemotCall).findOne({
        where: { apiCallId: call.callId }
      });

      if (existingCall) {
        this.activeCalls.set(call.callId, existingCall);
        this.logger.log(`Found existing call record: ${existingCall.id}`);
        return existingCall;
      }

      // Get user by phone
      const user = await this.dataSource.getRepository(User).findOne({ 
        where: { phoneNumber: call.did } 
      });

      if (!user) {
        this.logger.warn(`No user found for phone: ${call.did}`);
        return null;
      }

      // Create new call record
      const yemotCallRepo = this.dataSource.getRepository(YemotCall);
      const yemotCallRecord = yemotCallRepo.create({
        userId: user.id,
        user: user,
        apiCallId: call.callId,
        phone: call.phone || call.did,
        history: [], // Will store conversation steps
        currentStep: 'call_started',
        data: {
          callId: call.callId,
          phone: call.phone || call.did,
          startTime: new Date().toISOString(),
          version: 'v2'
        },
        isOpen: true,
        hasError: false
      });

      await yemotCallRepo.save(yemotCallRecord);
      this.activeCalls.set(call.callId, yemotCallRecord);
      this.logger.log(`Created call record: ${yemotCallRecord.id} for call ${call.callId}`);
      return yemotCallRecord;
    } catch (error) {
      this.logger.error(`Error initializing call tracking: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Drop the cached row at the end of a request, so the next request of the call
   * (maybe on another node) reads it fresh from the database.
   */
  releaseCall(callId: string): void {
    this.activeCalls.delete(callId);
  }

  /**
   * Whether the call has a row that isn't finalized yet
   */
  async isCallOpen(callId: string): Promise<boolean> {
    const yemotCallRecord = await this.findActiveCall(callId);
    return Boolean(yemotCallRecord?.isOpen);
  }

  /**
   * Runs fn once per call and key, storing its (JSON) result on the call row so later
   * requests of the same call get the same value. Without a row, fn just runs.
   */
  async once<T>(callId: string, key: string, fn: () => T | Promise<T>): Promise<T> {
    const yemotCallRecord = await this.findActiveCall(callId);
    if (!yemotCallRecord) {
      return fn();
    }

    const memo = (yemotCallRecord.data.memo ??= {});
    if (key in memo) {
      return memo[key];
    }

    const value = await fn();
    memo[key] = value ?? null;
    await this.dataSource.getRepository(YemotCall).save(yemotCallRecord);
    return value;
  }

  /**
   * Finalize call when it ends
   */
  async finalizeCall(callId: string): Promise<void> {
    try {
      const yemotCallRecord = await this.findActiveCall(callId);
      if (!yemotCallRecord) {
        this.logger.warn(`No call record found for finalization: ${callId}`);
        return;
      }
      if (!yemotCallRecord.isOpen) {
        this.activeCalls.delete(callId);
        return;
      }

      // Simple call end logging
      yemotCallRecord.currentStep = 'call_ended';
      yemotCallRecord.isOpen = false;
      yemotCallRecord.data.endTime = new Date().toISOString();

      await this.dataSource.getRepository(YemotCall).save(yemotCallRecord);
      this.activeCalls.delete(callId);
      this.logger.log(`Finalized call record: ${yemotCallRecord.id}`);
    } catch (error) {
      this.logger.error(`Error finalizing call: ${error.message}`, error.stack);
    }
  }

  /**
   * Record when Yemot reported the call over (its hangup=yes request). Kept even on a
   * call our own hangup already finalized: unlike endTime, it's when the caller's audio
   * really stopped, so it shows whether the last messages were heard to the end.
   */
  async recordHangup(callId: string): Promise<void> {
    try {
      const yemotCallRecord = await this.findActiveCall(callId);
      if (!yemotCallRecord) {
        this.logger.warn(`No call record found for hangup: ${callId}`);
        return;
      }

      yemotCallRecord.data.hangupTime = new Date().toISOString();
      await this.dataSource.getRepository(YemotCall).save(yemotCallRecord);
      this.activeCalls.delete(callId);
    } catch (error) {
      this.logger.error(`Error recording hangup: ${error.message}`, error.stack);
    }
  }

  /**
   * Log conversation step - what we prompted and what user responded
   */
  async logConversationStep(callId: string, prompt: string, userResponse?: string, stepType: string = 'interaction'): Promise<void> {
    try {
      const yemotCallRecord = await this.findActiveCall(callId);
      
      if (!yemotCallRecord) {
        this.logger.warn(`No call record found for conversation logging: ${callId}`);
        return;
      }

      // Create conversation step
      const conversationStep = {
        time: new Date(),
        params: { 
          prompt,
          stepType,
          ...(userResponse && { userResponse })
        },
        response: userResponse || 'waiting_for_input'
      };

      yemotCallRecord.history.push(conversationStep);
      yemotCallRecord.currentStep = stepType;
      
      // Store conversation data
      if (userResponse) {
        yemotCallRecord.data.lastResponse = userResponse;
        yemotCallRecord.data.lastPrompt = prompt;
      }

      await this.dataSource.getRepository(YemotCall).save(yemotCallRecord);
      this.logger.log(`Logged conversation: "${prompt}" -> "${userResponse || 'waiting'}"`);
    } catch (error) {
      this.logger.error(`Error logging conversation step: ${error.message}`, error.stack);
    }
  }

  /**
   * Mark call as having an error
   */
  async markCallError(callId: string, error: Error): Promise<void> {
    try {
      const yemotCallRecord = await this.findActiveCall(callId);
      if (yemotCallRecord) {
        yemotCallRecord.hasError = true;
        yemotCallRecord.errorMessage = error.message;
        await this.logConversationStep(callId, 'Error occurred', error.message, 'error');
      }
    } catch (dbError) {
      this.logger.error(`Error marking call error: ${dbError.message}`, dbError.stack);
    }
  }
}
