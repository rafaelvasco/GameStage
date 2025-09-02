/**
 * Platform singleton class that provides platform-specific functionality
 * for performance timing and other system-level operations.
 */
class Platform {
    private static instance: Platform;
    
    // Cache performance.now for faster access
    private static readonly perfNow = performance.now.bind(performance);
    
    // Pre-calculated constants to avoid repeated calculations
    private static readonly PERF_FREQ = 1000000; // microseconds per second
    private static readonly MS_TO_MICROSECONDS = 1000;

    private constructor() {}

    public static getInstance(): Platform {
        if (!Platform.instance) {
            Platform.instance = new Platform();
        }
        return Platform.instance;
    }

    /**
     * Gets the performance counter frequency.
     * In browsers, performance.now() returns milliseconds with microsecond precision,
     * so we return 1000000 to indicate microseconds per second for high precision timing.
     */
    public getPerfFreq(): number {
        return Platform.PERF_FREQ;
    }

    /**
     * Gets the current performance counter value.
     * In browsers, this uses performance.now() which returns a high-resolution timestamp
     * in milliseconds. We convert to microseconds for consistency with getPerfFreq().
     */
    public getPerfCounter(): number {
        return Platform.perfNow() * Platform.MS_TO_MICROSECONDS;
    }

    /**
     * Gets the current time in milliseconds with high precision.
     */
    public getHighResTime(): number {
        return Platform.perfNow();
    }
}

export default Platform; 