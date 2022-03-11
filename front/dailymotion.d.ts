/**
 * Extremely Incomplete
 */

interface DMState {
    videoTime: number;
    videoDuration: number;
    playerIsPlaying: boolean;
    playerIsMuted: boolean;
    videoSubtitles: string;
}

interface DMPlayer {
    loadContent(source: {
        video?: string;
        playlist?: string;
        startTime?: number;
    });
    play();
    pause();
    seek(seconds: number);
    setVolume(betweenZeroAndOne: number);
    setSubtitles(lang: string);
    setMute(on: boolean);
    destroy();
    on(event: string, listener: (DMState) => void);
    getState(): Promise<DMState>;
}

interface DailymotionAPI {
    createPlayer(targetDivId: string, options: any): Promise<DMPlayer>;
    events: Record<string, string>;
}

declare var dailymotion: DailymotionAPI;
