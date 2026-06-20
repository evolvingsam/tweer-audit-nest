import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { defer, firstValueFrom, retry } from 'rxjs';
import { Tweet } from '../models/tweet.model';
import { AuditResult } from '../models/audit-result.model';
import { SYSTEM_PROMPT, buildUserPrompt } from './criteria.constants';

@Injectable()
export class EvaluatorService implements OnModuleInit {
    private readonly logger = new Logger(EvaluatorService.name);
    private model: GenerativeModel;

    constructor(private configService: ConfigService) { }

    onModuleInit() {
        const apiKey = this.configService.get<string>('GOOGLE_API_KEY');
        if (!apiKey) {
            throw new Error('GOOGLE_API_KEY is required but not set in environment');
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        this.model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            systemInstruction: SYSTEM_PROMPT,
            generationConfig: {
                temperature: 0.1,
                responseMimeType: 'application/json',
            },
        });
    }

    async validateConnection(): Promise<void> {
        try {
            await this.model.generateContent('ping');
        } catch (error) {
            throw new Error(`Invalid or broken GOOGLE_API_KEY. Fix your API key.\nOriginal error: ${error.message}`);
        }
    }

    async evaluate(tweet: Tweet): Promise<AuditResult> {
        this.logger.debug(`Evaluating tweet ${tweet.id}`);

        const prompt = buildUserPrompt(tweet);

        // Using RxJS to recreate Python's Tenacity retry logic (exponential backoff)
        const request$ = defer(async () => {
            const response = await this.model.generateContent(prompt);
            const text = response.response.text();
            const result = JSON.parse(text);

            // Artificial delay to prevent rate limits, mimicking Python's asyncio.sleep(1.2)
            await new Promise((resolve) => setTimeout(resolve, 1200));

            return { url: tweet.tweetUrl, flag: Boolean(result.flag) };
        }).pipe(
            retry({
                count: 3,
                delay: (error, retryCount) => {
                    this.logger.warn(`Retrying tweet ${tweet.id} (Attempt ${retryCount}): ${error.message}`);
                    return new Promise((resolve) => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
                },
            })
        );

        try {
            return await firstValueFrom(request$);
        } catch (error) {
            this.logger.error(`Error evaluating tweet ${tweet.id} after retries: ${error.message}`);
            return { url: tweet.tweetUrl, flag: false };
        }
    }
}