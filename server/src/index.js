export const handler = async () => {
  console.log('Phoenix run started');
  console.log(`Timestamp: ${new Date().toISOString()}`);

  return { statusCode: 200 };
};
