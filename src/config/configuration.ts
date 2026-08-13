export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  gatewayApiKey: process.env.GATEWAY_API_KEY ?? '',
});
