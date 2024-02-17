mod publication;

const DEBUG: bool = false;

fn main() {
    let lao_tzu = publication::Author {
        id: 1,
        name: "Lao",
        surname: "Tzu",
    };
    let vyasa = publication::Author {
        id: 2,
        name: "Vyasa",
        ..Default::default()
    };
    let marcus = publication::Author {
        id: 3,
        name: "Marcus",
        surname: "Aurelius",
    };
    let book1 = publication::Book::new("Tao Te Ching", &lao_tzu, 224);
    let book2 = publication::Book::new("Bhagavad Gita", &vyasa, 701);
    let book3 = publication::Book::new("Meditations", &marcus, 701);
    // books that share the same name should share the same &str
    let jill = publication::Author {
        id: 4,
        name: "Jill",
        surname: "McCorkle",
    };
    let kate = publication::Author {
        id: 5,
        name: "Kate",
        surname: "Atkinson",
    };
    // note that we can do this because they are defined in the same scope
    // to try it out, uncomment the following:
    // let two_books_that_cannot_be_retrieved = different_scope(&jill, &kate);

    let book4 = publication::Book::new("Life After Life", &jill, 368);
    let book5 = publication::Book::new("Life After Life", &kate, 525);

    assert_eq!(
        &book4.title, &book5.title,
        "should have had the same address!!"
    );
    if DEBUG {
        let str_slice = "slice";
        let str_slice_2 = "slice";

        println!("{:p}", str_slice);
        println!("{:p}", str_slice_2);
    }

    let magazine1 = publication::Magazine::new("New Scientist", 3476, publication::Topic::Science);
    let magazine2 = publication::Magazine::new(
        "The Economist",
        (2024 - 1843) * 51 - 9,
        publication::Topic::Economy,
    );
    let magazine3 =
        publication::Magazine::new("Philosophy Now", 160, publication::Topic::Philosophy);

    let publications: Vec<publication::Publication<publication::Book, publication::Magazine>> = vec![
        publication::Publication::Book(book1),
        publication::Publication::Book(book2),
        publication::Publication::Book(book3),
        publication::Publication::Magazine(magazine1),
        publication::Publication::Magazine(magazine2),
        publication::Publication::Magazine(magazine3),
    ];

    publications.iter().for_each(|p| p.print());
}

// fn different_scope(
//     author_for_first: &Author<'_>,
//     author_for_second: &Author<'_>,
// ) -> [publication::Book<'static>; 2] {
//     // note that this won't compile since &str are defined in this scope
//     // it will complain by : lifetime may not live long enough
//     [
//         publication::Book::new("Life After Life", author_for_first, 368),
//         publication::Book::new("Life After Life", author_for_second, 525),
//     ]
// }
