"use strict";

(() => {
    const handleErrors = event => {
        process.on(event, error => {
            console.error(event, error.message, error.stack);
            process.exit(1);
        });
    };
    
    handleErrors('unhandledRejection');
    handleErrors('uncaughtError');
    handleErrors('warning');
})();
