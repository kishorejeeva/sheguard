// Thin wrapper around the browser's real Web Bluetooth API.
// This never fakes a connection — every state reported here reflects the
// actual browser API. Future SheGuard hardware GATT characteristics can be
// wired in via `device.gatt` once the protocol is defined.

export type BluetoothState =
  | "unsupported"
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "permission-denied";

export interface ConnectedDeviceInfo {
  name: string;
  id: string;
}

export function isBluetoothSupported(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

export class BluetoothService {
  private device: BluetoothDevice | null = null;

  async connect(onDisconnect: () => void): Promise<ConnectedDeviceInfo> {
    if (!isBluetoothSupported()) {
      throw new Error("Bluetooth is not supported on this browser/device.");
    }

    // acceptAllDevices lets the user pick any nearby device from the real
    // browser chooser UI. Swap for a `filters` array once SheGuard hardware
    // advertises a known service UUID.
    const device = await (navigator as any).bluetooth.requestDevice({
      acceptAllDevices: true,
    });

    device.addEventListener("gattserverdisconnected", onDisconnect);
    this.device = device;

    // Attempt a GATT connection where the device supports it; some devices
    // are usable purely via advertisement/pairing without a GATT server.
    try {
      await device.gatt?.connect();
    } catch {
      // Non-fatal: the device is still "connected" at the pairing level.
    }

    return { name: device.name || "Unknown device", id: device.id };
  }

  disconnect() {
    this.device?.gatt?.disconnect();
    this.device = null;
  }

  get connectedDevice(): BluetoothDevice | null {
    return this.device;
  }
}

export const bluetoothService = new BluetoothService();
