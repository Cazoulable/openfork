FROM rust:1.92 AS builder
WORKDIR /app
COPY . .
RUN cargo build --release --bin openfork-server

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/openfork-server /usr/local/bin/
CMD ["openfork-server"]
