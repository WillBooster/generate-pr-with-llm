export function configureEnvVars(): void {
  if (!process.env.AWS_REGION && process.env.AWS_REGION_NAME) {
    process.env.AWS_REGION = process.env.AWS_REGION_NAME;
  } else if (process.env.AWS_REGION && !process.env.AWS_REGION_NAME) {
    process.env.AWS_REGION_NAME = process.env.AWS_REGION;
  }

  if (!process.env.GEMINI_API_KEY && process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    process.env.GEMINI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  } else if (process.env.GEMINI_API_KEY && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = process.env.GEMINI_API_KEY;
  }
}
