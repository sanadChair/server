import { dbRepositories } from '#src/db/db.repositories.js';
import { StatusCodes } from 'http-status-codes';

class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
    this.statusCode = statusCode;
    }
}

export async function Authenticator(req, res, next) {
    try {
        if (!req.body.id) {
            throw new AppError(
                'an authenticated path must have the "id" field on its body',
                StatusCodes.BAD_REQUEST
            );
        }

        const user = await dbRepositories.user.findOne({ where: { id: req.body.id } });

        if (user && req.get('x-dev-user')) {
            console.log(`[Authenticator] dev bypass for user ${req.body.id}`);
            return next();
        }

        if (user) {
            throw new AppError(
                'authentication is not implemented yet, try setting x-dev-user for testing',
                StatusCodes.NOT_IMPLEMENTED
            );
        } else {
            throw new AppError(
                'user not found, try again with correct body.id',
                StatusCodes.NOT_FOUND
            );
        }
    } catch (err) {
        next(err);
    }
}
