# Build stage - compiles and packages the Spring Boot jar
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -B dependency:go-offline
COPY src ./src
RUN mvn -B package -DskipTests

# Run stage - small runtime image, no build tools
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/target/mega-city-cab.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
