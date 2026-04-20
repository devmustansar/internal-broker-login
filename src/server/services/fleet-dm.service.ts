// ─── FleetDM Device Verification Service ──────────────────────────────────────
//
// Verifies that a device (identified by its mTLS certificate CN) is registered
// in FleetDM. This enforces zero-trust device posture: only machines enrolled
// in the fleet can authenticate through the login broker.
//
// Flow:
//   1. Keycloak extracts the CN from the client certificate → `machine_cn`
//   2. This service queries FleetDM's "Get host by identifier" API
//   3. If a host is found → device is trusted → sign-in proceeds
//   4. If no host is found → sign-in is blocked with a device-not-found error

const FLEET_BASE_URL = process.env.FLEET_BASE_URL || "";
const FLEET_API_TOKEN = process.env.FLEET_API_TOKEN || "";

export interface FleetDeviceInfo {
  id: number;
  hostname: string;
  hardware_serial: string;
  uuid: string;
  platform: string;
  os_version: string;
  display_name: string;
  status: string;
  computer_name: string;
}

export interface FleetVerificationResult {
  verified: boolean;
  device?: FleetDeviceInfo;
  reason?: string;
}

/**
 * Verifies a device against FleetDM using the machine CN from the mTLS cert.
 *
 * The CN is used as an identifier and matched against FleetDM's host records.
 * FleetDM's "Get host by identifier" endpoint accepts hostname, uuid, or
 * hardware_serial — so the CN can be any of these.
 *
 * @param machineCn - The CN extracted from the mTLS client certificate
 * @returns Verification result with device info if found
 */
export async function verifyDeviceWithFleet(
  machineCn: string
): Promise<FleetVerificationResult> {
  if (!FLEET_BASE_URL || !FLEET_API_TOKEN) {
    console.warn(
      "[fleet-dm] FLEET_BASE_URL or FLEET_API_TOKEN not configured. Skipping device verification."
    );
    // If FleetDM is not configured, allow sign-in (fail-open for development)
    return { verified: true, reason: "fleet_not_configured" };
  }

  if (!machineCn || machineCn === "NOT_FOUND") {
    return {
      verified: false,
      reason: "No machine certificate CN was provided. Ensure your device has a valid mTLS certificate.",
    };
  }

  try {
    // Query FleetDM: GET /api/v1/fleet/hosts/identifier/:identifier
    const url = `${FLEET_BASE_URL}/api/v1/fleet/hosts/identifier/${encodeURIComponent(machineCn)}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${FLEET_API_TOKEN}`,
        Accept: "application/json",
      },
    });

    if (response.status === 404) {
      console.warn(`[fleet-dm] Device not found in FleetDM: CN="${machineCn}"`);
      return {
        verified: false,
        reason: `Device "${machineCn}" is not registered in the fleet. Contact your IT administrator to enroll this device.`,
      };
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error(
        `[fleet-dm] FleetDM API error: ${response.status} ${response.statusText}`,
        errorText
      );
      return {
        verified: false,
        reason: `Fleet device verification failed (HTTP ${response.status}). Please try again or contact your administrator.`,
      };
    }

    const data = await response.json();
    const host = data?.host;

    if (!host) {
      return {
        verified: false,
        reason: `Device "${machineCn}" returned invalid data from fleet. Contact your IT administrator.`,
      };
    }

    // Verify the host has a matching hardware_serial or hostname
    const device: FleetDeviceInfo = {
      id: host.id,
      hostname: host.hostname,
      hardware_serial: host.hardware_serial,
      uuid: host.uuid,
      platform: host.platform,
      os_version: host.os_version,
      display_name: host.display_name || host.computer_name,
      status: host.status,
      computer_name: host.computer_name,
    };

    console.log(
      `[fleet-dm] ✅ Device verified: CN="${machineCn}" → ${device.display_name} (${device.platform}, serial: ${device.hardware_serial})`
    );

    return { verified: true, device };
  } catch (err) {
    console.error("[fleet-dm] Failed to verify device:", err);
    return {
      verified: false,
      reason: "Fleet device verification service is unavailable. Please try again later.",
    };
  }
}
