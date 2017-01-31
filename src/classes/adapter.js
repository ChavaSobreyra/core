const Base = require('./base')
const Knex = require('knex')

module.exports = class Adapter extends Base {
  /**
   * Sets up the knex query builder instance
   * @constructor
   */
  constructor (config) {
    super()
    this.config = config
    this.knex = Knex({
      client: 'pg',
      connection: config,
      searchPath: 'knex,public'
    })
  }

  /**
   * Converts a models attributes hash into an array of column names for use in
   * an sql query
   *
   * @param {Object} attributes - attributes hash of the form
   * @example {title: 'string', createdAt: 'date'}
   * @return {Array} - an array of column names
   */
  fieldsFromAttributes (attributes) {
    return Object.keys(attributes)
  }

  parseIncludes () {

  }

  include () {

  }

  /**
   * Finds all records for a given model. @see `query` when you need more control over
   * what records are returned.
   *
   * @param {Object} Model - object with properties `tableName` and an `attributes` hash
   * @return {Array} - array of database records
   */
  findAll (Model) {
    const attributes = this.fieldsFromAttributes(Model.definition.attributes)
    const tableName = Model.tableName
    return this.knex.column(attributes).select().from(tableName)
  }

  /*
  options should be implemented here to jsonapi spec
  {
    include: 'comments, posts, comments.author',
    fields: {
      articles: 'title, body',
      people: 'name'
    },
    sort: 'age, -name',
    page: {number: 1, size: 20},
    filter: {}
  }
  */
  query (Model, options) {
    const attributes = this.fieldsFromAttributes(Model.definition.attributes)
    const tableName = Model.tableName

    if (typeof options.fields === 'object') {
      const types = Object.keys(options.fields)
      if (types.indexOf(Model.type) !== -1) {
        const fields = options.fields[Model.type].split(',').map(field => field.trim())
        for (const attr of attributes) {
          if (fields.indexOf(attr) === -1) {
            attributes.splice(attributes.indexOf(attr))
          }
        }
        attributes.push('id')
      }
    }

    let query = this.knex.column(attributes).select().from(tableName)

    if (typeof options.page === 'object' && options.page.number && options.page.size) {
      query = query
        .limit(options.page.size)
        .offset(options.page.number * options.page.size - options.page.size)
    }

    if (typeof options.sort === 'string') {
      options.sort.split(',').forEach(column => {
        const direction = (column.indexOf('-') !== -1) ? 'DESC' : 'ASC'
        column = column.replace('-', '')
        query = query.orderBy(column.trim(), direction)
      })
    }

    if (typeof options.include === 'string') {
      const includes = this.parseIncludes(options.include)
      for (const include of includes) {
        // needs to recurse since we may need to get comments for posts but also
        // author for comments
        // I think the include is going to need to perform queries, create
        // lists and then merge them
        this.include(query, include)
      }
    }

    return query
  }

  /**
   * Retrieves a single record for the given model by given id
   *
   * @param {Object} Model - object with properties `tableName` and an `attributes` hash
   * @param {number} id - id of record to retrieve
   * @return {Object} - a single record or null if no record was found
   */
  findRecord (Model, id) {
    const attributes = this.fieldsFromAttributes(Model.definition.attributes)
    const tableName = Model.tableName
    return this.knex.column(attributes).first().from(tableName).where({id}).limit(1)
      .then(result => result || null)
  }

  queryRecord (Model, options) {
    return this.query(Model, options).first().limit(1)
  }

  createRecord (Model, data) {
    const tableName = Model.tableName
    return this.knex(tableName).insert(data)
  }

  updateRecord (Model, id, data) {
    const tableName = Model.tableName
    return this.knex(tableName).update(data).where('id', id)
  }

  deleteRecord (Model, id) {
    const tableName = Model.tableName
    return this.knex(tableName).where('id', id).delete()
  }
}
