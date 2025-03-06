export const directFetchEntertainmentConfigs = async (ip: string, user: string) => {
  const response = await fetch(`http://${ip}/api/${user}/groups`);
  const data = await response.json();
  return Object.values(data).filter((group: any) => group.type === 'Entertainment');
};

export const formatEntertainmentConfig = (config: any) => {
  return {
    id: config.id,
    name: config.name,
    lights: config.lights || [],
    type: config.type,
    status: config.status || 'inactive'
  };
};
