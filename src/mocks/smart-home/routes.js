import { Router } from 'express';
import {
    controlDev,
    factoryReset,
    getInfo,
    getStatus,
    updateName,
} from './smart-dev.controller.js';
const mockSmartHomeRouter = Router();



mockSmartHomeRouter.get('/info', getInfo);

mockSmartHomeRouter.get('/status', getStatus);

mockSmartHomeRouter.post('/control', controlDev);

mockSmartHomeRouter.post('/name', updateName);

mockSmartHomeRouter.delete('/factoryReset', factoryReset);

export default mockSmartHomeRouter;
