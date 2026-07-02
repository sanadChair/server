import timestamper from './timestamp.js';

export const errorWrapper = controller => {
    return async (req, res, next) => {
        try {
            const result = await controller(req, res, next);
            return res.send({
                success: true,
                data: result,
                meta: { timestamp: timestamper() },
            });
        } catch (err) {
            next(err);
        }
    };
};

export const resultDefinedWrapper = controller => {
    return async (req, res, next) => {
        const result = await controller(req, res, next);
        if (result === undefined || result === null) {
            throw new Error('result is not defined');
        }
        return result;
    };
};

export const globalControllerWrapper = controller => {
    return errorWrapper(resultDefinedWrapper(controller));
};
