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
   * Initialize call tracking when a new call starts
   */
  async initializeCall(call: Call): Promise<void> {
    try {
      if (!call.callId || !call.did) {
        this.logger.warn('Cannot initialize call tracking: missing callId or did');
        return;
      }

      // Check if call already exists
      const existingCall = await this.dataSource.getRepository(YemotCall).findOne({
        where: { apiCallId: call.callId }
      });

      if (existingCall) {
        this.activeCalls.set(call.callId, existingCall);
        this.logger.log(`Found existing call record: ${existingCall.id}`);
        return;
      }

      // Get user by phone
      const user = await this.dataSource.getRepository(User).findOne({ 
        where: { phoneNumber: call.did } 
      });

      if (!user) {
        this.logger.warn(`No user found for phone: ${call.did}`);
        return;
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
    } catch (error) {
      this.logger.error(`Error initializing call tracking: ${error.message}`, error.stack);
    }
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
