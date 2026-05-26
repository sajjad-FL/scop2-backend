export const status = {
  path: '/api/v1',
  method: 'GET',
  config: {
    description: 'Heath Check',
    tags: ['api', 'Health'],
    notes: ['Use this route to get the health of the API'],
    plugins: {
      'hapi-swagger': {},
    },
  },
  handler: (request, h) => {
    return h.response({
      message: 'Scope 2.0 API is up and running.',
      success: true,
    }).code(200);
  },
};
