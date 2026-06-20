export class Tweet {
    id: string;
    dateCreated: Date;
    fullText: string;
    username: string;

    constructor(partial: Partial<Tweet>) {
        Object.assign(this, partial);
    }

    get tweetUrl(): string {
        return `https://x.com/${this.username}/status/${this.id}`;
    }
}