/* babel.config.js
    
    Babel configuration.
*/

// Dependencies.
import CONFIG from "#root/config";

export default (api) => {
    return {
        presets: [ "@babel/preset-env" ],
        
        plugins: [
            "@babel/plugin-proposal-class-properties",
            "@babel/plugin-proposal-object-rest-spread",
            "@babel/plugin-proposal-export-default-from",
            "@babel/plugin-syntax-dynamic-import",
            "@babel/plugin-transform-async-to-generator",
            
            [
                "@babel/plugin-transform-runtime",
                {
                    helpers: false
                }
            ]
        ],
        
        sourceType: "unambiguous"
    };
};
