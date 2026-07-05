import React from 'react';
import { smartHomeApi } from '../api/client';
import { Trash2, MapPin, Activity } from 'lucide-react';

const DeviceCard = ({ device, onStateChange, onDelete }) => {
    const { deviceId, name, position, control_type, state, connected } = device;
    const isActive = Number(state) === 1;
    const isConnected = Boolean(connected);

    const toggleState = async () => {
        if (!isConnected) return;
        const newState = isActive ? 0 : 1;
        try {
            await smartHomeApi.controlDevice(deviceId, newState);
            if (onStateChange) onStateChange(deviceId, newState);
        } catch (error) {
            console.error('Failed to change state', error);
        }
    };

    const handleDelete = async () => {
        const confirmed = window.confirm(
            'This will factory reset and permanently remove the device from the system. Continue?'
        );
        if (!confirmed) return;

        try {
            await smartHomeApi.deleteDevice(deviceId);
            if (onDelete) onDelete(deviceId);
        } catch (error) {
            console.error('Failed to delete', error);
        }
    }

    return (
        <div className="bg-white rounded-[20px] border border-slate-200 shadow-sm p-5 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                    <div
                        className={`w-2.5 h-2.5 rounded-full ${
                            !isConnected
                                ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.35)]'
                                : 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]'
                        }`}
                    ></div>
                    <span className="text-xs font-semibold text-slate-400 tracking-wider">ID: {deviceId}</span>
                </div>
                <button onClick={handleDelete} className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded-md hover:bg-red-50">
                    <Trash2 className="w-4 h-4"/>
                </button>
            </div>
            
            <h3 className="text-xl font-bold text-slate-800 mb-1 line-clamp-1">{name}</h3>
            
            <div className="flex items-center gap-1.5 text-sm text-slate-500 mb-6">
                <MapPin className="w-3.5 h-3.5" />
                <span className="truncate">{position || 'Unassigned Zone'}</span>
                <span className="mx-1 text-slate-300">•</span>
                <Activity className="w-3.5 h-3.5" />
                <span className="capitalize">{control_type}</span>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                    {!isConnected ? 'Disconnected' : ['slider', 'dimmer', 'range'].includes(control_type?.toLowerCase()) ? 'Operating' : isActive ? 'Operating' : 'Standby'}
                </span>
                
                {/* iOS Style Toggle Switch for binary, range slider for slider/dimmer/range */}
                {['slider', 'dimmer', 'range'].includes(control_type?.toLowerCase()) ? (
                    <div className="flex items-center gap-2 w-1/2">
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={state}
                            disabled={!isConnected}
                            onChange={async (e) => {
                                const val = Number(e.target.value);
                                try {
                                    await smartHomeApi.controlDevice(deviceId, val);
                                    if (onStateChange) onStateChange(deviceId, val);
                                } catch (error) {
                                    console.error('Failed to change state', error);
                                }
                            }}
                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <span className="text-xs font-semibold text-slate-500 w-8 text-right">{state}</span>
                    </div>
                ) : (
                    <button 
                      onClick={toggleState}
                      disabled={!isConnected}
                      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ${
                          !isConnected ? 'bg-slate-100 opacity-60 cursor-not-allowed' : isActive ? 'bg-indigo-600' : 'bg-slate-200'
                      }`}
                    >
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${isActive ? 'translate-x-6' : 'translate-x-[4px]'}`} />
                    </button>
                )}
            </div>
        </div>
    );
};

export default DeviceCard;
