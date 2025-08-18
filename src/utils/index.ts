export const deepMerge = (target: any, source: any): any => {
  const result = { ...target };
  for (const key in source) {
    if (source[key] instanceof Object && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
};

export const isEqual = (target: any, source: any): boolean => {
  if (target === source) {
    return true;
  }

  if (target == null || source == null) {
    return target === source;
  }

  if (typeof target !== "object" || typeof source !== "object") {
    return target === source;
  }

  if (Array.isArray(target) && Array.isArray(source)) {
    if (target.length !== source.length) {
      return false;
    }
    for (let i = 0; i < target.length; i++) {
      if (!isEqual(target[i], source[i])) {
        return false;
      }
    }
    return true;
  }

  if (Array.isArray(target) || Array.isArray(source)) {
    return false;
  }

  const targetKeys = Object.keys(target);
  const sourceKeys = Object.keys(source);

  if (targetKeys.length !== sourceKeys.length) {
    return false;
  }

  for (const key of targetKeys) {
    if (!source.hasOwnProperty(key)) {
      return false;
    }
    if (!isEqual(target[key], source[key])) {
      return false;
    }
  }

  return true;
};
