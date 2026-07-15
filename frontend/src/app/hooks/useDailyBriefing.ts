import { useQuery } from '@tanstack/react-query';
import { propertyService, aiService } from '@vera/services';
import { appConfig } from '@vera/config';

/** Validates the AIService + Provider pattern end-to-end (mocked). */
export function useDailyBriefing() {
  return useQuery({
    queryKey: ['daily-briefing'],
    queryFn: async () => {
      const active = await propertyService.getProperties({ status: 'active' });
      const portfolioValue = await propertyService.getPortfolioValue();
      return aiService.generateDailyBriefing({
        activeProperties: active.length,
        portfolioValue,
        currency: appConfig.defaultCurrency,
      });
    },
  });
}
