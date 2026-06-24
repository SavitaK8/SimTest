class FeatureExtractor {
    static extract(domState) {
        // Convert raw DOM states into structural feature vectors
        const features = {
            page_length: domState.length || 0,
            clickable_count: (domState.match(/<a |<button |onclick=/g) || []).length,
            form_count: (domState.match(/<form /g) || []).length,
            auth_required: /login|signin|password/i.test(domState) ? 1 : 0,
            error_messages: /error|invalid|failed/i.test(domState) ? 1 : 0
        };
        
        // Return as an array of values for the neural model
        return [
            features.page_length,
            features.clickable_count,
            features.form_count,
            features.auth_required,
            features.error_messages
        ];
    }
}

export {  FeatureExtractor  };
