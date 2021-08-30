build:
	docker build -t firebase .

init:
# Initialize and store configs on host's filesystem.
	docker run -it -v $$HOME/.config:/root/.config firebase init emulators

run:
	docker run \
	-p 4000:4000 \
	-p 9199:9199 \
	-v $$HOME/.config:/root/.config \
	firebase emulators:start
