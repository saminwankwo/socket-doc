import AjvModule from "ajv";
const Ajv = AjvModule.default || AjvModule;
const ajv = new Ajv();
export function createValidator(eventDef) {
    if (eventDef.payload) {
        return {
            validate: (data) => {
                const result = eventDef.payload.safeParse(data);
                if (result.success) {
                    return { success: true, data: result.data };
                }
                return { success: false, error: result.error.issues };
            }
        };
    }
    if (eventDef.payloadSchema) {
        const validate = ajv.compile(eventDef.payloadSchema);
        return {
            validate: (data) => {
                const valid = validate(data);
                if (valid) {
                    return { success: true, data };
                }
                return { success: false, error: validate.errors };
            }
        };
    }
    return {
        validate: (data) => ({ success: true, data })
    };
}
