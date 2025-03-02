/**
 * Debug utilities for Phillips Hue connection issues
 */

/**
 * Inspects an object and logs its methods
 */
export function inspectObject(obj: any, name: string = 'Object'): void {
  console.log(`------ Inspecting ${name} ------`);
  if (!obj) {
    console.log(`${name} is null or undefined`);
    return;
  }

  console.log(`Type: ${typeof obj}`);

  if (typeof obj !== 'object' && typeof obj !== 'function') {
    console.log(`Value: ${String(obj)}`);
    return;
  }

  try {
    // For functions, log the function source
    if (typeof obj === 'function') {
      console.log(`Function name: ${obj.name || 'anonymous'}`);
      console.log(`Function toString:`, obj.toString().substring(0, 100) + '...');
    }

    // Get own properties
    const ownProps = Object.getOwnPropertyNames(obj);
    console.log(`Own properties (${ownProps.length}):`, ownProps);

    // Get prototype
    const proto = Object.getPrototypeOf(obj);
    if (proto) {
      const protoProps = Object.getOwnPropertyNames(proto);
      console.log(`Prototype properties (${protoProps.length}):`, protoProps);
    }

    // Log specific methods we care about
    const methodsToCheck = ['start', 'stop', 'connect', 'disconnect', 'transition', 'setLightState'];
    methodsToCheck.forEach(method => {
      console.log(`Has ${method}: ${typeof obj[method] === 'function'}`);
      if (typeof obj[method] === 'function') {
        console.log(`- ${method} is: ${obj[method].toString().substring(0, 50)}...`);
      }
    });
  } catch (error) {
    console.error(`Error inspecting ${name}:`, error);
  }
  console.log(`------ End Inspection of ${name} ------`);
}

/**
 * Creates enhanced bridge object with debug wrappers around methods
 */
export function enhanceBridgeWithDebug(bridge: any): any {
  if (!bridge) return bridge;

  const methodsToWrap = ['start', 'stop', 'connect', 'disconnect', 'transition', 'setLightState'];

  methodsToWrap.forEach(methodName => {
    if (typeof bridge[methodName] === 'function') {
      const originalMethod = bridge[methodName];
      bridge[methodName] = function(...args: any[]) {
        console.log(`DEBUG: Calling ${methodName} with args:`, args);
        try {
          const result = originalMethod.apply(this, args);
          if (result && typeof result.then === 'function') {
            return result.then(
              (value: any) => {
                console.log(`DEBUG: ${methodName} resolved with:`, value);
                return value;
              },
              (error: any) => {
                console.error(`DEBUG: ${methodName} rejected with:`, error);
                throw error;
              }
            );
          }
          console.log(`DEBUG: ${methodName} returned:`, result);
          return result;
        } catch (error) {
          console.error(`DEBUG: ${methodName} threw error:`, error);
          throw error;
        }
      };
    }
  });

  return bridge;
}

export default {
  inspectObject,
  enhanceBridgeWithDebug
};
