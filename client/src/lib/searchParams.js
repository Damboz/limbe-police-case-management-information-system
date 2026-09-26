export function paramsToObject(searchParams, keys) {
    return keys.reduce((acc, key) => {
        acc[key] = searchParams.get(key) || '';
        return acc;
    }, {});
}


export function objectToParams(values) {
    return Object.entries(values).reduce((acc, [key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            acc[key] = value;
        }
        return acc;
    }, {});
}


export function paramsKey(values) {
    return JSON.stringify(objectToParams(values));
}
