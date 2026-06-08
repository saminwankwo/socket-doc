export interface Validator {
    validate: (data: any) => {
        success: boolean;
        data?: any;
        error?: any;
    };
}
export declare function createValidator(eventDef: any): Validator;
