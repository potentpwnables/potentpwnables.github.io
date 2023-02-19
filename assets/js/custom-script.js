document.addEventListener("DOMContentLoaded", function() {

    const images = document.getElementsByTagName("img");
    let imageSource;

    images.forEach(image => {
        image.addEventListener("click", e => {
            imageSource = e.target.src;
            imageModal(imageSource);
        })
    });

    let imageModal = src => {
        const modal = document.createElement("div");
        modal.setAttribute("class", "modal");
        document.body.append(modal);

        const newImage = document.createElement("img");
        newImage.setAttribute("src", src);
        modal.append(newImage);

        const closeButton = document.createElement("i");
        closeButton.setAttribute("class", "fas fa-times closeBtn");
        closeButton.onclick = () => {
            modal.remove();
        };
        modal.append(closeButton);
    }

});