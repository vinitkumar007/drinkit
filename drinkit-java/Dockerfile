# Build stage: compiles the app with Maven (tests are skipped here; run `mvn test` yourself first).
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /build
COPY pom.xml .
RUN mvn -B -q dependency:go-offline
COPY src ./src
RUN mvn -B -q -DskipTests package

# Run stage: only the Java runtime and the finished jar.
FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /build/target/drinkit.jar app.jar
ENV APP_ENV=production \
    DB_FILE=/data/drinkit \
    PORT=3000
VOLUME /data
EXPOSE 3000
# Small heap so it fits Render's free 512 MB plan.
ENTRYPOINT ["java", "-XX:+UseSerialGC", "-Xmx320m", "-jar", "app.jar"]
