/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["pptxgenjs", "docx", "exceljs"],
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
};
export default nextConfig;
