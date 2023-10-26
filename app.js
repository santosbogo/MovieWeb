const express = require('express');
const sqlite3 = require('sqlite3');
const ejs = require('ejs');

const app = express();
const port = process.env.PORT || 3000;

// Serve static files from the "views" directory
app.use(express.static('views'));

// Conectar a la base de datos SQLite
const db = new sqlite3.Database('movies/movies.db');

// Configurar el motor de plantillas EJS
app.set('view engine', 'ejs');

// Ruta para la página de inicio
app.get('/', (req, res) => {
    res.render('index');
});

// Ruta para buscar películas, actores y directores
app.get('/buscar', (req, res) => {
    const searchTerm = req.query.q;

    // Create an object to store the results for each category
    const results = {
        movies: [],
        actors: [],
        directors: [],
        keywords : [],
    };

    // Search for movies
    const movieQuery = `
        select distinct *
        from movie 
        where title like ?
        order by title asc;
    `;

    // Search for actors with pattern in their names
    const actorQuery = `
        select distinct person_name, p.person_id
        from person p
        join movie_cast mc on p.person_id = mc.person_id
        where person_name like ?
        order by person_name asc;
    `;

    // Search for directors with pattern in their names
    const directorQuery = `
        select distinct person_name, p.person_id
        from person p
        join movie_crew mc on p.person_id = mc.person_id
        where person_name like ?
        and mc.job = 'Director'
        order by person_name asc;
    `;

    const keywordQuery = `
        select distinct *
        from movie
        join movie_keywords mk on movie.movie_id = mk.movie_id
        join keyword k on k.keyword_id = mk.keyword_id
        where keyword_name like ?
        order by title asc;
    `;

    // Execute the movie query
    db.all(movieQuery, [`%${searchTerm}%`], (err, movieRows) => {
        if (!err) {
            results.movies = movieRows;
        }

        // Execute the actor query
        db.all(actorQuery, [`%${searchTerm}%`], (err, actorRows) => {
            if (!err) {
                results.actors = actorRows;
            }

            // Execute the director query
            db.all(directorQuery, [`%${searchTerm}%`], (err, directorRows) => {
                if (!err) {
                    results.directors = directorRows;
                }

                // Execute the keyword query
                db.all(keywordQuery, [`%${searchTerm}%`], (err, keywordRows) => {
                    if (!err){
                        results.keywords = keywordRows;
                    }

                    // Render the results page and pass the results object
                    res.render('resultado', { results });
                });
            });
        });
    });
});



// Ruta para la página de datos de una película particular
app.get('/pelicula/:id', (req, res) => {
    const movieId = req.params.id;

    // Consulta SQL para obtener los datos de la película, elenco y crew
    const query = `
    SELECT DISTINCT
      movie.*,
      actor.person_name as actor_name,
      actor.person_id as actor_id,
      crew_member.person_name as crew_member_name,
      crew_member.person_id as crew_member_id,
      movie_cast.character_name,
      movie_cast.cast_order,
      department.department_name,
      movie_crew.job,
      genre.genre_name,
      country.country_name,
      production_company.company_name,
      keyword.keyword_name,
      language_role.language_role,
      language.language_name
    FROM movie
    LEFT JOIN movie_cast ON movie.movie_id = movie_cast.movie_id
    LEFT JOIN person as actor ON movie_cast.person_id = actor.person_id
    LEFT JOIN movie_crew ON movie.movie_id = movie_crew.movie_id
    LEFT JOIN department ON movie_crew.department_id = department.department_id
    LEFT JOIN person as crew_member ON crew_member.person_id = movie_crew.person_id

    left join movie_genres on movie.movie_id = movie_genres.movie_id
    left join genre on movie_genres.genre_id = genre.genre_id
    left join production_country on movie.movie_id = production_country.movie_id
    left join country on production_country.country_id = country.country_id
    left join movie_company on movie.movie_id = movie_company.movie_id
    left join production_company on movie_company.company_id = production_company.company_id
    left join movie_keywords on movie.movie_id = movie_keywords.movie_id
    left join keyword on movie_keywords.keyword_id = keyword.keyword_id
    left join movie_languages on movie.movie_id = movie_languages.movie_id
    left join language_role on movie_languages.language_role_id = language_role.role_id
    left join language on movie_languages.language_id = language.language_id
    WHERE movie.movie_id = ?
  `;

    // Ejecutar la consulta
    db.all(query, [movieId], (err, rows) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error al cargar los datos de la película.');
        } else if (rows.length === 0) {
            res.status(404).send('Película no encontrada.');
        } else {
            // Organizar los datos en un objeto de película con elenco y crew
            const movieData = {
                id: rows[0].id,
                title: rows[0].title,
                release_date: rows[0].release_date,
                overview: rows[0].overview,
                directors: [],
                writers: [],
                cast: [],
                crew: [],
                genres: [],
                companies: [],
                keywords: [],
                languages: [],
            };

            // Crear un objeto para almacenar directores
            rows.forEach((row) => {
                if (row.crew_member_id && row.crew_member_name && row.department_name && row.job) {
                    // Verificar si ya existe una entrada con los mismos valores en directors
                    const isDuplicate = movieData.directors.some((crew_member) =>
                        crew_member.crew_member_id === row.crew_member_id
                    );

                    if (!isDuplicate) {
                        // Si no existe, agregar los datos a la lista de directors
                        if (row.department_name === 'Directing' && row.job === 'Director') {
                            movieData.directors.push({
                                crew_member_id: row.crew_member_id,
                                crew_member_name: row.crew_member_name,
                                department_name: row.department_name,
                                job: row.job,
                            });
                        }
                    }
                }
            });

            // Crear un objeto para almacenar writers
            rows.forEach((row) => {
                if (row.crew_member_id && row.crew_member_name && row.department_name && row.job) {
                    // Verificar si ya existe una entrada con los mismos valores en writers
                    const isDuplicate = movieData.writers.some((crew_member) =>
                        crew_member.crew_member_id === row.crew_member_id
                    );

                    if (!isDuplicate) {
                        // Si no existe, agregar los datos a la lista de writers
                        if (row.department_name === 'Writing' && row.job === 'Writer') {
                            movieData.writers.push({
                                crew_member_id: row.crew_member_id,
                                crew_member_name: row.crew_member_name,
                                department_name: row.department_name,
                                job: row.job,
                            });
                        }
                    }
                }
            });

            // Crear un objeto para almacenar el elenco
            rows.forEach((row) => {
                if (row.actor_id && row.actor_name && row.character_name) {
                    // Verificar si ya existe una entrada con los mismos valores en el elenco
                    const isDuplicate = movieData.cast.some((actor) =>
                        actor.actor_id === row.actor_id
                    );

                    if (!isDuplicate) {
                    // Si no existe, agregar los datos a la lista de elenco
                        movieData.cast.push({
                            actor_id: row.actor_id,
                            actor_name: row.actor_name,
                            character_name: row.character_name,
                            cast_order: row.cast_order,
                        });
                    }
                }
            });

            // Crear un objeto para almacenar el crew
            rows.forEach((row) => {
                if (row.crew_member_id && row.crew_member_name && row.department_name && row.job) {
                    // Verificar si ya existe una entrada con los mismos valores en el crew
                    const isDuplicate = movieData.crew.some((crew_member) =>
                        crew_member.crew_member_id === row.crew_member_id
                    );

                    // console.log('movieData.crew: ', movieData.crew)
                    // console.log(isDuplicate, ' - row.crew_member_id: ', row.crew_member_id)
                    if (!isDuplicate) {
                        // Si no existe, agregar los datos a la lista de crew
                        if (row.department_name !== 'Directing' && row.job !== 'Director'
                        && row.department_name !== 'Writing' && row.job !== 'Writer') {
                            movieData.crew.push({
                                crew_member_id: row.crew_member_id,
                                crew_member_name: row.crew_member_name,
                                department_name: row.department_name,
                                job: row.job,
                            });
                        }
                    }
                }
            });

            rows.forEach((row) => {
                // Add genre
                if (row.genre_name && !movieData.genres.includes(row.genre_name)) {
                    movieData.genres.push(row.genre_name);
                }

                // Add production company and country
                if (row.company_name && row.country_name) {
                    const companyInfo = {
                        company_name: row.company_name,
                        country_name: row.country_name
                    };

                    if (!movieData.companies.some((company) =>
                        company.company_name === companyInfo.company_name &&
                        company.country_name === companyInfo.country_name)) {
                        movieData.companies.push(companyInfo);
                    }
                }

                // Add keyword
                if (row.keyword_name && !movieData.keywords.includes(row.keyword_name)) {
                    movieData.keywords.push(row.keyword_name);
                }

                // Add language
                if (row.language_name && !movieData.languages.includes(row.language_name)) {
                    movieData.languages.push(row.language_name);
                }
            });

            res.render('pelicula', { movie: movieData });
        }
    });
});

// Ruta para mostrar la página de un actor específico
app.get('/actor/:id', (req, res) => {
    const actorId = req.params.id;

    // Consulta SQL para obtener las películas en las que participó el actor
    const query = `
    SELECT DISTINCT
      person.person_name as actorName,
      movie.*
    FROM movie
    INNER JOIN movie_cast ON movie.movie_id = movie_cast.movie_id
    INNER JOIN person ON person.person_id = movie_cast.person_id
    WHERE movie_cast.person_id = ?;
  `;

    // Ejecutar la consulta
    db.all(query, [actorId], (err, movies) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error al cargar las películas del actor.');
        } else {
            // Obtener el nombre del actor
            const actorName = movies.length > 0 ? movies[0].actorName : '';

            res.render('actor', { actorName, movies });
        }
    });
});

// Ruta para mostrar la página de un director específico
app.get('/director/:id', (req, res) => {
    const directorId = req.params.id;

    // Consulta SQL para obtener las películas dirigidas por el director
    const query = `
    SELECT DISTINCT
      person.person_name as directorName,
      movie.*
    FROM movie
    INNER JOIN movie_crew ON movie.movie_id = movie_crew.movie_id
    INNER JOIN person ON person.person_id = movie_crew.person_id
    WHERE movie_crew.job = 'Director' AND movie_crew.person_id = ?;
  `;


    // console.log('query = ', query)

    // Ejecutar la consulta
    db.all(query, [directorId], (err, movies) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error al cargar las películas del director.');
        } else {
            // console.log('movies.length = ', movies.length)
            // Obtener el nombre del director
            const directorName = movies.length > 0 ? movies[0].directorName : '';
            res.render('director', { directorName, movies });
        }
    });
});

// Ruta para conseguir la página de una persona
app.get('/person/:id', (req, res) => {
    const personId = req.params.id;

    const results = {
        actorName: '',
        moviesActed: [],
        moviesDirected: [],
    };

    const actorQuery = `
        SELECT person_name
        FROM person
        WHERE person_id = ?;
    `;

    // Consulta SQL para obtener las películas en las que participó como actor
    const actedQuery = `
        SELECT m.*
        FROM movie_cast mc
        JOIN movie m ON mc.movie_id = m.movie_id
        WHERE mc.person_id = ?;
    `;

    // Consulta SQL para obtener las películas en las que fue director
    const directedQuery = `
        SELECT m.*
        FROM movie_crew mc
        JOIN movie m ON mc.movie_id = m.movie_id
        WHERE mc.person_id = ? AND mc.job = 'Director';
    `;

    // Ejecutar la consulta para películas en las que actuó
    db.all(actedQuery, [personId], (err, actedRows) => {
        if (!err) {
            results.moviesActed = actedRows;

            // Ejecutar la consulta para películas dirigidas
            db.all(directedQuery, [personId], (err, directedRows) => {
                if (!err) {
                    results.moviesDirected = directedRows;

                    db.get(actorQuery, [personId], (err, actorRow) => {
                        if (!err) {
                            results.actorName = actorRow.person_name; // Asigna el nombre del actor
                        }

                        // Renderiza la página de la persona and pasa los resultados
                        res.render('person', results);
                    });
                } else {
                    console.error(err);
                    res.status(500).send('Error al cargar las películas dirigidas por la persona.');
                }
            });
        } else {
            console.error(err);
            res.status(500).send('Error al cargar las películas en las que la persona actuó.');
        }
    });
});

// Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor en ejecución en http://localhost:${port}`);
});
