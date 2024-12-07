import resolveConfig from "tailwindcss/resolveConfig";
import tailwindConfig from '../../tailwind.config';

async function getTheme() {
  const fullTWConfig = resolveConfig(tailwindConfig as any);
  return fullTWConfig.theme;
}

export default getTheme();
