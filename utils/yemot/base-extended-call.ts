import { DataSource, QueryRunner } from 'typeorm';
import { Call, TapOptions } from 'yemot-router2';
import { Logger } from '@nestjs/common';
import { id_list_message, id_list_message_with_hangup } from './yemot-router';
import { User } from '@shared/entities/User.entity';

/**
 * Type extension for the Yemot Call interface with base shared functionality
 */
declare module 'yemot-router2' {
  interface Call {
    userId?: number;
    
    // Context management methods
    setContext<T>(key: string, value: T): void;
    getContext<T>(key: string): T | undefined;
    
    // Logging methods
    logInfo(message: string): void;
    logDebug(message: string): void;
    logWarn(message: string): void;
    logError(message: string, stack?: string): void;
    
    // Call interaction methods
    getConfirmation(message: string, yesOption?: string, noOption?: string): Promise<boolean>;
    readDigits(promptText: string, options: TapOptions): Promise<string>;
    playMessage(message: string): Promise<void>;
    hangupWithMessage(message: string): Promise<void>;
    
    // Message handling
    getText(key: string, values?: Record<string, string>): string;
    
    // Error handling & retry
    withRetry<T>(
      operation: () => Promise<T>,
      options?: {
        retryMessage?: string,
        errorMessage?: string,
        maxAttempts?: number
      }
    ): Promise<T>;
    
    // Database operations
    withTransaction<T>(fn: (queryRunner: QueryRunner) => Promise<T>): Promise<T>;
    
    // Common telephony operations
    findUserByPhone(): Promise<User | null>;
    getDataSource(): DataSource;
  }
}

/**
 * Factory function that creates a base extended call with shared functionality
 * This can be used across different telephony projects
 */
export function createBaseExtendedCall(call: Call, logger: Logger, dataSource: DataSource, messageConstants: any): Call {
  // Create a new object that copies all properties and methods from the original call
  const extendedCall = Object.create(Object.getPrototypeOf(call), Object.getOwnPropertyDescriptors(call)) as Call;

  // Context storage
  const context: Record<string, any> = {};

  // Context management methods
  extendedCall.setContext = function <T>(key: string, value: T): void {
    context[key] = value;
    extendedCall.logDebug(`Context set: ${key}`);
  };

  extendedCall.getContext = function <T>(key: string): T | undefined {
    return context[key];
  };

  // Enhanced Logging capabilities
  extendedCall.logInfo = function (message: string): void {
    logger.log(`[Call ${extendedCall.callId}] ${message}`);
  };
  
  extendedCall.logDebug = function (message: string): void {
    logger.debug(`[Call ${extendedCall.callId}] ${message}`);
  };
  
  extendedCall.logWarn = function (message: string): void {
    logger.warn(`[Call ${extendedCall.callId}] ${message}`);
  };
  
  extendedCall.logError = function (message: string, stack?: string): void {
    logger.error(`[Call ${extendedCall.callId}] ${message}`, stack);
  };

  // Call interaction methods
  extendedCall.getConfirmation = async function (
    message: string,
    yesOption: string = 'לחץ 1',
    noOption: string = 'לחץ 2',
  ): Promise<boolean> {
    extendedCall.logDebug(`Getting confirmation: ${message}`);
    const promptMessage = `${message} ${yesOption}, ${noOption}`;

    const response = await extendedCall.read([{ type: 'text', data: promptMessage }], 'tap', {
      max_digits: 1,
      min_digits: 1,
      digits_allowed: ['1', '2'],
    }) as string;

    const confirmed = response === '1';
    extendedCall.logDebug(`Confirmation response: ${confirmed ? 'Yes' : 'No'}`);
    return confirmed;
  };

  extendedCall.readDigits = async function (promptText: string, options: TapOptions): Promise<string> {
    extendedCall.logDebug(`Reading digits with prompt: ${promptText}`);
    const result = await extendedCall.read([{ type: 'text', data: promptText }], 'tap', options) as string;
    extendedCall.logDebug(`Digits entered: ${result}`);
    return result;
  };

  extendedCall.playMessage = async function (message: string): Promise<void> {
    extendedCall.logDebug(`Playing message: ${message}`);
    await id_list_message(extendedCall, message);
  };

  extendedCall.hangupWithMessage = async function (message: string): Promise<void> {
    extendedCall.logDebug(`Hanging up with message: ${message}`);
    await id_list_message_with_hangup(extendedCall, message);
  };

  // Message retrieval method
  extendedCall.getText = function (key: string, values?: Record<string, string>): string {
    const keyParts = key.split('.');
    let message: any = messageConstants;
    
    for (const part of keyParts) {
      if (message[part] === undefined) {
        extendedCall.logError(`Message key not found: ${key}`);
        return key;
      }
      message = message[part];
    }
    
    if (typeof message !== 'string') {
      extendedCall.logError(`Message key is not a string: ${key}`);
      return key;
    }
    
    if (values) {
      for (const [placeholder, value] of Object.entries(values)) {
        message = (message as string).replace(new RegExp(`{${placeholder}}`, 'g'), value);
      }
    }
    
    return message;
  };

  // Transaction support
  extendedCall.withTransaction = async function <T>(fn: (queryRunner: QueryRunner) => Promise<T>): Promise<T> {
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const result = await fn(queryRunner);
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      extendedCall.logError(`Transaction failed: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  };

  // Enhanced retry capability
  extendedCall.withRetry = async function <T>(
    operation: () => Promise<T>,
    options: {
      retryMessage?: string,
      errorMessage?: string,
      maxAttempts?: number
    } = {}
  ): Promise<T> {
    const maxAttempts = options.maxAttempts ?? 3;
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        return await operation();
      } catch (error) {
        attempts++;
        extendedCall.logError(`Operation failed (${attempts}/${maxAttempts}): ${error.message}`);

        if (attempts >= maxAttempts) {
          if (options.errorMessage) {
            await extendedCall.hangupWithMessage(options.errorMessage);
          }
          throw error;
        }

        if (options.retryMessage) {
          await extendedCall.playMessage(options.retryMessage);
        }
      }
    }

    // This should never happen due to the throw above
    throw new Error('Max retry attempts reached');
  };

  // Basic user lookup - common in telephony apps
  extendedCall.findUserByPhone = async function (): Promise<User | null> {
    extendedCall.logInfo(`Finding user for phone number: ${extendedCall.did}`);
    const userRepository = dataSource.getRepository(User);
    const user = await userRepository.findOneBy({ phoneNumber: extendedCall.did });
    if (user) {
      extendedCall.logInfo(`User found: ${user.id}`);
      extendedCall.userId = user.id;
      extendedCall.setContext('user', user);
    } else {
      extendedCall.logError(`User not found for phone number: ${extendedCall.did}`);
    }
    return user;
  };

  extendedCall.getDataSource = function (): DataSource {
    return dataSource;
  };

  return extendedCall;
}
