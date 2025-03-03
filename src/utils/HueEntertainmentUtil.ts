/**
 * Utility for handling Hue Entertainment API configurations
 *
 * According to Philips Hue Entertainment API documentation
 * https://developers.meethue.com/develop/hue-entertainment/hue-entertainment-api/
 */

// Interface for channels within entertainment configuration
interface EntertainmentChannel {
  channel_id: number;
  position: {
    x: number;
    y: number;
    z: number;
  };
  members?: Array<{
    service: {
      rtype: string;
      rid: string;
    };
    index: number;
  }>;
}

// Interface matching the CLIP v2 entertainment_configuration response
export interface EntertainmentConfiguration {
  id: string;
  type: string;
  metadata: {
    name: string;
  };
  configuration_type: string;
  channels: EntertainmentChannel[];
  status: "inactive" | "active";
  light_services?: Array<{
    rtype: string;
    rid: string;
  }>;
}

/**
 * Fetches entertainment configurations directly using fetch API
 * This provides an alternative to the electron IPC method
 */
// Enhanced version with more detailed logs
export async function directFetchEntertainmentConfigs(
  bridgeIp: string,
  username: string
): Promise<EntertainmentConfiguration[]> {
  try {
    console.log(`🌐 Direct fetch: Requesting entertainment configs from ${bridgeIp}`);

    console.log(`📡 GET https://${bridgeIp}/clip/v2/resource/entertainment_configuration`);
    console.log(`📡 Headers: { 'hue-application-key': '${username.substring(0, 5)}...' }`);

    try {
      // First, try a non-HTTPS call to see if the bridge is reachable
      const pingResponse = await fetch(`http://${bridgeIp}/api/config`);
      const pingData = await pingResponse.json();
      console.log(`🔍 Bridge ping response: ${pingResponse.status}`, pingData);
    } catch (pingError) {
      console.log(`⚠️ Bridge ping failed (not critical): ${pingError}`);
    }

    // Now do the actual HTTPS call that matters
    const response = await fetch(`https://${bridgeIp}/clip/v2/resource/entertainment_configuration`, {
      headers: {
        'hue-application-key': username
      }
    });

    console.log(`📥 Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      throw new Error(`Error fetching entertainment configurations: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('📥 Raw entertainment config response:', data);

    if (data && data.data && Array.isArray(data.data)) {
      console.log(`✅ Found ${data.data.length} entertainment configurations`);

      // Detailed logging of each configuration
      data.data.forEach((config, index) => {
        console.log(`🔍 Configuration #${index+1}:`);
        console.log(`   ID: ${config.id}`);
        console.log(`   Name: ${config.metadata?.name || config.name || 'Unnamed'}`);
        console.log(`   Status: ${config.status || 'unknown'}`);
        console.log(`   Type: ${config.configuration_type || 'unknown'}`);

        const lightCount = config.light_services?.length || 0;
        console.log(`   Light services: ${lightCount}`);

        if (config.light_services && config.light_services.length > 0) {
          console.log('   Light service IDs:', config.light_services.map(svc => svc.rid).join(', '));
        }
      });

      return data.data;
    }

    console.log('⚠️ No data array in response or empty array');
    return [];
  } catch (error) {
    console.error('❌ Error direct fetching entertainment configurations:', error);
    throw error;
  }
}

/**
 * Formats an entertainment configuration for UI display
 */
// Enhanced formatter with better logging
export function formatEntertainmentConfig(config: EntertainmentConfiguration) {
  console.log('🔧 Formatting entertainment config:', config.id);

  const name = config.metadata?.name || config.name || `Entertainment ${config.id.substring(0, 8)}...`;
  const type = config.configuration_type || config.type || 'unknown';
  const status = config.status || 'inactive';
  const lights = config.light_services?.map(svc => svc.rid) || [];

  const formattedConfig = {
    id: config.id,
    name: name,
    type: type,
    status: status,
    channels: config.channels?.length || 0,
    lights: lights
  };

  console.log('🔧 Formatted configuration:', formattedConfig);
  return formattedConfig;
}

/**
 * Activates an entertainment configuration for streaming
 */
export async function activateEntertainmentConfig(
  bridgeIp: string,
  username: string,
  configId: string
): Promise<boolean> {
  try {
    console.log(`Activating entertainment configuration ${configId}`);

    const url = `https://${bridgeIp}/clip/v2/resource/entertainment_configuration/${configId}`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'hue-application-key': username
      },
      body: JSON.stringify({ action: "start" })
    });

    if (!response.ok) {
      throw new Error(`Failed to activate entertainment configuration: ${response.status}`);
    }

    console.log('Entertainment configuration activated successfully');
    return true;
    } catch (error) {
    console.error('Error activating entertainment configuration:', error);
    return false;
    }
  }
