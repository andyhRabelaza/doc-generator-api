import axios, { AxiosRequestConfig } from "axios";

interface CircuitBreakerOptions {
  timeoutMs?: number;
  maxRetries?: number;
}

export async function circuitBreakerRequest<T>(
  url: string,
  config?: AxiosRequestConfig,
  options?: CircuitBreakerOptions
): Promise<T | null> {
  const timeout = options?.timeoutMs ?? 5000;
  const maxRetries = options?.maxRetries ?? 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const source = axios.CancelToken.source();
      const timer = setTimeout(() => source.cancel(`Timeout ${timeout}ms`), timeout);

      const response = await axios({ url, cancelToken: source.token, ...config });
      clearTimeout(timer);
      return response.data;
    } catch (err: any) {
      console.warn(`⚠️ Attempt ${attempt} failed for ${url}:`, err.message);
      if (attempt === maxRetries) {
        console.error(`❌ Circuit breaker triggered for ${url}, using fallback`);
        return null; // fallback
      }
    }
  }
  return null;
}