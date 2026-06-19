from groq import Groq
import json
from app.core.config import settings

groq_client = Groq(api_key=settings.GROQ_API_KEY)

def generate_file_tags(filename: str) -> dict:
    """Agentic workflow to generate semantic JSON tags based on filename."""
    try:
        # Prompt Engineering for strict JSON
        prompt = f"""
        You are a highly intelligent file organization AI. 
        Analyze this filename: '{filename}'
        Generate exactly 3 highly relevant tags.
        
        You must ONLY output valid JSON. No conversational text.
        Format strictly like this:
        {{"tags": ["tag1", "tag2", "tag3"]}}
        """
        
        chat_completion = groq_client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.3-70b-versatile",
            temperature=0.1, # Low temp = highly deterministic
            response_format={"type": "json_object"} # Native JSON Mode!
        )
        
        # Parse the JSON string from AI into a Python Dictionary
        result_str = chat_completion.choices[0].message.content
        return json.loads(result_str)
        
    except Exception as e:
        print(f"AI JSON Error: {e}")
        return {"tags": ["untagged"]}