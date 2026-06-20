import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import { Tweet } from '../models/tweet.model';

@Injectable()
export class LoaderService {
    private readonly logger = new Logger(LoaderService.name);

    private extractJson(filepath: string): any {
        this.logger.debug(`Extracting JSON from ${filepath}`);
        const content = fs.readFileSync(filepath, 'utf-8');

        if (!content.includes('=')) {
            throw new Error(`Invalid JS wrapper format in ${filepath}`);
        }

        const jsonStr = content.substring(content.indexOf('=') + 1).trim();
        try {
            const data = JSON.parse(jsonStr);
            this.logger.debug(`Successfully extracted JSON from ${filepath}`);
            return data;
        } catch (e) {
            this.logger.error(`Failed to parse JSON from ${filepath}: ${e.message}`);
            throw e;
        }
    }

    loadAccount(filepath: string): string {
        this.logger.log(`Loading account from ${filepath}`);
        try {
            const data = this.extractJson(filepath);
            const username = data[0].account.username;
            this.logger.log(`Successfully loaded account: ${username}`);
            return username;
        } catch (e) {
            this.logger.error(`Failed to extract username from ${filepath}`);
            throw e;
        }
    }

    private preprocess(rawTweet: any, username: string): Tweet {
        return new Tweet({
            id: rawTweet.id_str,
            dateCreated: new Date(rawTweet.created_at),
            fullText: rawTweet.full_text,
            username: username,
        });
    }

    *streamTweets(filepath: string, username: string): Generator<Tweet, void, unknown> {
        this.logger.log(`Starting to stream tweets from ${filepath}`);
        const data = this.extractJson(filepath);
        let tweetCount = 0;

        for (const item of data) {
            try {
                const tweet = this.preprocess(item.tweet, username);
                tweetCount++;
                yield tweet;
            } catch (e) {
                this.logger.warn(`Skipping tweet due to preprocessing error: ${e.message}`);
            }
        }
        this.logger.log(`Streamed ${tweetCount} tweets from ${filepath}`);
    }
}