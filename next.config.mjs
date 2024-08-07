/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // domains: ["res.cloudinary.com"],  //deprecated
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
