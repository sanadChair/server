import { z, ZodError } from 'zod';
import { StatusCodes } from 'http-status-codes';

export function dataValidation(SchemaObject) {
    return (req, res, next) => {
        try {
            if (SchemaObject.body) SchemaObject.body.parse(req.body);
            if (SchemaObject.params) SchemaObject.params.parse(req.params);
            if (SchemaObject.query) SchemaObject.query.parse(req.query);
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                const message = error.errors.map(issue => ({
                    message: `${issue.path.join('.')} is ${issue.message}`,
                }));
                return res.status(StatusCodes.BAD_REQUEST).json({
                    error: 'Invalid data',
                    details: message,
                });
            }
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'Internal Server Error' });
        }
    };
}
