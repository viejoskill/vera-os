import type { AIProvider } from './ai-provider';

export interface DailyBriefingContext {
  activeProperties: number;
  portfolioValue: number;
  currency: string;
}

/**
 * AIService — VERA's intelligence layer. It composes prompts and delegates generation
 * to an injected {@link AIProvider} (Provider Pattern). It knows nothing about vendors.
 */
export class AIService {
  constructor(private readonly provider: AIProvider) {}

  async generateDailyBriefing(context: DailyBriefingContext): Promise<string> {
    const value = new Intl.NumberFormat('es-AR').format(context.portfolioValue);
    const prompt =
      `Hoy gestionás ${context.activeProperties} propiedades activas por un valor de ` +
      `cartera de ${context.currency} ${value}. Priorizá los leads sin contactar y ` +
      `confirmá las visitas de la jornada.`;
    const result = await this.provider.complete({
      prompt,
      system: 'Sos VERA, un asistente inmobiliario conciso y accionable.',
    });
    return result.text;
  }

  async ask(prompt: string): Promise<string> {
    const result = await this.provider.complete({ prompt });
    return result.text;
  }
}
