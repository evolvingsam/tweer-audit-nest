import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import { createObjectCsvWriter } from 'csv-writer';
import { LoaderService } from './loader/loader.service';
import { EvaluatorService } from './evaluator/evaluator.service';
import { Tweet } from './models/tweet.model';

@Injectable()
export class AppService {
    private readonly logger = new Logger(AppService.name);
    private readonly BATCH_SIZE = 50;

    constructor(
        private readonly loaderService: LoaderService,
        private readonly evaluatorService: EvaluatorService,
    ) { }

    async run() {
        this.logger.log('Tweet audit process started');
        await this.evaluatorService.validateConnection();

        const accountPath = path.join(process.cwd(), 'data', 'account.js');
        const tweetsPath = path.join(process.cwd(), 'data', 'tweets.js');
        const outputPath = path.join(process.cwd(), 'output.csv');

        const username = this.loaderService.loadAccount(accountPath);

        const csvWriter = createObjectCsvWriter({
            path: outputPath,
            header: [
                { id: 'tweet_url', title: 'tweet_url' },
                { id: 'deleted', title: 'deleted' },
            ],
        });

        this.logger.log('Output file ready: output.csv');

        let batch: Tweet[] = [];
        let totalTweets = 0;

        for (const tweet of this.loaderService.streamTweets(tweetsPath, username)) {
            batch.push(tweet);
            totalTweets++;

            if (batch.length >= this.BATCH_SIZE) {
                this.logger.log(`Processing batch (total tweets processed so far: ${totalTweets})`);
                await this.processBatch(batch, csvWriter);
                batch = [];
            }
        }

        if (batch.length > 0) {
            this.logger.log(`Processing final batch of ${batch.length} tweets`);
            await this.processBatch(batch, csvWriter);
        }

        this.logger.log(`Tweet audit completed successfully. Total tweets processed: ${totalTweets}`);
    }

    private async processBatch(batch: Tweet[], csvWriter: any) {
        this.logger.debug(`Processing batch of ${batch.length} tweets`);

        // Execute concurrent evaluations
        const results = await Promise.all(batch.map((t) => this.evaluatorService.evaluate(t)));

        const flagged = results.filter((r) => r.flag);

        if (flagged.length > 0) {
            await csvWriter.writeRecords(
                flagged.map(f => ({ tweet_url: f.url, deleted: f.flag }))
            );
        }

        this.logger.debug(`Batch processing complete: ${flagged.length}/${batch.length} tweets flagged for deletion`);
    }
}