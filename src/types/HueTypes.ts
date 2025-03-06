export interface HueBridge {
  id: string;
  name?: string;
  ip: string;
  mac?: string;
}

export interface HueCredentials {
  username: string;
  clientkey: string;
}

export interface EntertainmentGroup {
  id: string;
  name: string;
  lights: string[];
}

export interface HueSettings {
  bridge: HueBridge;
  credentials: HueCredentials;
  selectedGroup: string;
}

export interface LightState {
  lightIds: number[];
  rgb: number[];
  transitionTime: number;
}