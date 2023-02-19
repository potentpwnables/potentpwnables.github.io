document.addEventListener("DOMContentLoaded", function() {
    const images = document.getElementsByTagName("article")[0].getElementsByTagName("img");
    let imageSource;

    for (let i=0; i < images.length; i++) {
        images[i].addEventListener("click", e => {
            imageSource = e.target.src;
            imageModal(imageSource);
        })
    };

    let imageModal = src => {
        document.body.style.overflow = "hidden";
        const modal = document.createElement("div");
        modal.setAttribute("class", "modal");
        modal.onclick = () => {
            document.body.style.overflow = "auto";
            modal.remove();
        };
        document.body.append(modal);

        const newImage = document.createElement("img");
        newImage.setAttribute("src", src);
        modal.append(newImage);

        const closeButton = document.createElement("i");
        closeButton.setAttribute("class", "fas fa-times closeBtn");
        closeButton.onclick = () => {
            document.body.style.overflow = "auto";
            modal.remove();
        };
        modal.append(closeButton);
    }

});