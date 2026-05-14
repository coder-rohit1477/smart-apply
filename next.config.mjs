/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Exclude canvas from server-side bundle (optional peer dep of pdfjs-dist)
      config.externals = [...(config.externals || []), { canvas: "canvas" }];
    }

    // Prevent canvas from being bundled on client side too
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };

    return config;
  },

  // Increase body size limit for resume uploads (PDFs can be several MB)
  experimental: {
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
