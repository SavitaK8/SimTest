require('dotenv').config();

async function runTest() {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
        console.error("❌ GEMINI_API_KEY environment variable is not set.");
        return;
    }

    try {
        console.log("Fetching available models...");
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models`, {
            headers: {
                'x-goog-api-key': key
            }
        });
        if (!response.ok) {
            const err = await response.text();
            throw new Error(`API returned ${response.status}: ${err}`);
        }
        
        const data = await response.json();
        console.log("✅ API Connection Successful. Available Models:");
        data.models.forEach(m => console.log(` - ${m.name} (${m.displayName})`));
        
    } catch (e) {
        console.log(`❌ Fetch failed:`, e.message);
    }
}
runTest();
