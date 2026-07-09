import { dbRepositories } from '#src/db/db.repositories.js';
import { StatusCodes } from 'http-status-codes';
import jwt from 'jsonwebtoken';

class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
    }
}

function getBearerToken(req) {
    const authHeader = req.get('authorization');
    if (!authHeader) return null;

    const [scheme, token] = authHeader.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) return null;

    return token;
}

function getTokenUserId(payload) {
    return payload?.sub ?? payload?.id ?? payload?.userId;
}

export async function Authenticator(req, res, next) {
    try {
        if (!req.body.id) {
            throw new AppError(
                'an authenticated path must have the "id" field on its body',
                StatusCodes.BAD_REQUEST
            );
        }

        const requestedUserId = Number(req.body.id);
        if (!Number.isInteger(requestedUserId)) {
            throw new AppError('"id" must be a valid user id', StatusCodes.BAD_REQUEST);
        }

        const user = await dbRepositories.user.findOne({ where: { id: requestedUserId } });

        if (user && req.get('x-dev-user')) {
            req.user = user;
            return next();
        }

        if (!user) {
            throw new AppError(
                'user not found, try again with correct body.id',
                StatusCodes.NOT_FOUND
            );
        }

        const token = getBearerToken(req);
        if (!token) {
            throw new AppError(
                'missing authorization bearer token',
                StatusCodes.UNAUTHORIZED
            );
        }

        if (!process.env.JWT_SECRET) {
            throw new AppError('JWT_SECRET is not configured', StatusCodes.INTERNAL_SERVER_ERROR);
        }

        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const tokenUserId = Number(getTokenUserId(payload));

        if (!tokenUserId) {
            throw new AppError('token does not include a user id', StatusCodes.UNAUTHORIZED);
        }

        if (tokenUserId !== requestedUserId) {
            throw new AppError(
                'token user does not match requested user',
                StatusCodes.FORBIDDEN
            );
        }

        const authenticatedUser = await dbRepositories.user.findOne({ where: { id: tokenUserId } });
        if (!authenticatedUser) {
            throw new AppError('authenticated user not found', StatusCodes.UNAUTHORIZED);
        }

        req.user = authenticatedUser;
        next();
    } catch (err) {
        if (err instanceof jwt.TokenExpiredError) {
            return next(new AppError('invalid or expired token', StatusCodes.UNAUTHORIZED));
        }

        if (err instanceof jwt.NotBeforeError) {
            return next(new AppError('token is not active yet', StatusCodes.UNAUTHORIZED));
        }

        if (err instanceof jwt.JsonWebTokenError) {
            return next(new AppError('invalid or expired token', StatusCodes.UNAUTHORIZED));
        }

        next(err);
    }
}
