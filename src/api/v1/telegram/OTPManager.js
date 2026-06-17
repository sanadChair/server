export class OTPManager {
    static pendingSessions = {};

    static addPendingSession(phoneNumber) {
        // controller will identify the pending number session
        // then on submitting the otp the pending status will be changed when the function finish?
        // so first set the pending promise, and then return the resolver of that promise
        this.pendingSessions[phoneNumber] = {};
        let codeResolver;
        let sessionSuccessResolver;
        const pendingOtp = new Promise((resolve, reject) => {
            codeResolver = { resolve, reject };
        });
        const pendingSession = new Promise((resolve, reject) => {
            sessionSuccessResolver = { resolve, reject };
        });
        this.pendingSessions[phoneNumber] = {
            pendingOtp,
            pendingSession,
            codeResolver,
            sessionSuccessResolver,
        };
        return this.pendingSessions[phoneNumber];
    }

    static hasAPendingSession(phoneNumber) {
        return Boolean(this.pendingSessions[phoneNumber]);
    }

    static getPendingSession(phoneNumber) {
        const pendingSession = this.pendingSessions[phoneNumber];
        if (!pendingSession) {
            throw new Error('no pending telegram session found for this phone number');
        }
        return pendingSession;
    }

    static resolveOtpCode(phoneNumber, code) {
        const pendingSession = this.getPendingSession(phoneNumber);
        pendingSession.codeResolver.resolve(code);
    }

    static rejectOtpCode(phoneNumber, err) {
        const pendingSession = this.getPendingSession(phoneNumber);
        pendingSession.codeResolver.reject(err);
    }

    static resolvePendingSession(phoneNumber, session) {
        const pendingSession = this.getPendingSession(phoneNumber);
        pendingSession.sessionSuccessResolver.resolve(session);
    }

    static rejectPendingSession(phoneNumber, err) {
        const pendingSession = this.getPendingSession(phoneNumber);
        pendingSession.sessionSuccessResolver.reject(err);
    }
}
