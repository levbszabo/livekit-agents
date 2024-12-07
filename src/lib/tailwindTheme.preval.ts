import { resolveConfig } from 'tailwindcss';
import tailwindConfig from '../../tailwind.config';

async function getTheme() {
  // Cast the config to any to avoid type issues with the complex theme structure
  const fullTWConfig = resolveConfig(tailwindConfig as any);
  return fullTWConfig.theme;
}

export default getTheme();
