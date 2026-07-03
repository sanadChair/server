import { mockSmartHomeDeviceStore } from './device-store.js';

export async function getInfo(req, res) {
    const id = req.query.id ?? req.query.deviceId;
    if (!id) {
        return res.status(200).json(mockSmartHomeDeviceStore.getAllDevices());
    }

    try {
        const device = await mockSmartHomeDeviceStore.findDevice(id);
        if (!device) {
            return res.status(404).json({ status: 'failed', reason: 'device not found' });
        }
        return res.status(200).json(device);
    } catch (err) {
        return res.status(500).json({ status: 'failed', reason: err.message });
    }
}

export async function getStatus(req, res) {
    const id = req.query.id ?? req.query.deviceId;
    if (!id) {
        return res.status(200).json(
            Object.fromEntries(
                Object.entries(mockSmartHomeDeviceStore.getAllDevices()).map(([deviceId, device]) => [
                    deviceId,
                    {
                        deviceId,
                        state: device.state,
                        control_type: device.control_type,
                    },
                ])
            )
        );
    }

    try {
        const device = await mockSmartHomeDeviceStore.findDevice(id);
        if (!device) {
            return res.status(404).json({ status: 'failed', reason: 'device not found' });
        }
        return res.status(200).json({
            deviceId: device.deviceId,
            id: device.id,
            state: device.state,
            control_type: device.control_type,
        });
    } catch (err) {
        return res.status(500).json({ status: 'failed', reason: err.message });
    }
}

export async function controlDev(req, res) {
    const id = req.body?.id ?? req.body?.deviceId;
    if (!id || req.body?.state === undefined) {
        return res.status(400).send({ status: 'failed', reason: 'id and state are required' });
    }

    try {
        const device = await mockSmartHomeDeviceStore.updateState(id, req.body.state);
        if (!device) {
            return res.status(404).send({ status: 'failed', reason: 'device not found' });
        }
        return res.status(201).send({ status: 'success', device });
    } catch (err) {
        return res.status(500).send({ status: 'failed', reason: err.message });
    }
}

export async function updateName(req, res) {
    const id = req.body?.id ?? req.body?.deviceId;
    const name = req.body?.name;
    if (!id || !name) {
        return res.status(400).send({ status: 'failed', reason: 'id and name are required' });
    }

    try {
        const device = await mockSmartHomeDeviceStore.updateName(id, name);
        if (!device) {
            return res.status(404).send({ status: 'failed', reason: 'device not found' });
        }
        return res.status(200).send({ status: 'success', device });
    } catch (err) {
        return res.status(500).send({ status: 'failed', reason: err.message });
    }
}

export async function factoryReset(req, res) {
    const id = req.query.id ?? req.query.deviceId;
    if (!id) {
        return res.status(400).send({ status: 'failed', reason: 'id is required' });
    }

    try {
        const device = await mockSmartHomeDeviceStore.removeDevice(id);
        if (!device) {
            return res.status(404).send({ status: 'failed', reason: 'device not found' });
        }
        return res.status(200).send({ status: 'success', device });
    } catch (err) {
        return res.status(500).send({ status: 'failed', reason: err.message });
    }
}
