use std::fmt::{Display, Formatter, Result};

/* use &str to leverage fly-weight pattern i.e.
```rust
    let str_slice = "slice";
    let str_slice_2 = "slice";

    println!("{:p}", str_slice);
    println!("{:p}", str_slice_2);
```
    The print statements print the same address thus same string slice values use the same address, saving us memory.
    Since the references are immutable, it is safe.
*/
pub trait Printable {
    fn print(&self) -> String;
}

#[derive(Clone)]
pub struct Author<'a> {
    pub(crate) id: usize,
    pub(crate) name: &'a str,
    pub(crate) surname: &'a str,
}

impl<'a> Default for Author<'a> {
    fn default() -> Self {
        Self {
            id: 0,
            name: "",
            surname: "",
        }
    }
}

impl<'a> Display for Author<'a> {
    fn fmt(&self, f: &mut Formatter) -> Result {
        write!(f, "({}, {} {})", self.id, self.name, self.surname)
    }
}

pub trait Authored {
    fn get_author(&self) -> Author;
}
pub trait Issued {
    fn get_issue(&self) -> usize;
}
pub enum Publication<B, M>
where
    B: Authored + Printable,
    M: Issued + Printable,
{
    Book(B),
    Magazine(M),
}

impl<B, M> Publication<B, M>
where
    B: Authored + Printable,
    M: Issued + Printable,
{
    pub fn print(&self) {
        let printed: String;
        let pub_type: &str;
        match self {
            Publication::Book(b) => {
                pub_type = "Book";
                printed = b.print();
            }
            Publication::Magazine(m) => {
                pub_type = "Magazine";
                printed = m.print();
            }
        }
        println!("{} : {}", pub_type, printed);
    }
}

#[derive(Debug)]
pub enum Topic {
    Science,
    Economy,
    Philosophy,
}

pub struct Book<'a> {
    pub(crate) title: &'a str,
    author: &'a Author<'a>,
    page_count: usize,
}

impl<'a, 'b> Book<'a>
where
    'b: 'a,
{
    pub fn new(title: &'a str, author: &'b Author, page_count: usize) -> Self {
        Book {
            title,
            author: author,
            page_count,
        }
    }
}

impl Authored for Book<'_> {
    fn get_author(&self) -> Author {
        self.author.clone()
    }
}

impl Printable for Book<'_> {
    fn print(&self) -> String {
        format!(
            "{} author: {}, [{}]",
            self.title, self.author, self.page_count
        )
        .to_string()
    }
}

pub struct Magazine<'a> {
    title: &'a str,
    issue: usize,
    topic: Topic,
}

impl<'a> Magazine<'a> {
    pub fn new(title: &'a str, issue: usize, topic: Topic) -> Self {
        Magazine {
            title: title,
            issue: issue,
            topic: topic,
        }
    }
}

impl<'a> Printable for Magazine<'a> {
    fn print(&self) -> String {
        format!(
            "{} - issue: {}, [{:#?}]",
            self.title, self.issue, self.topic,
        )
    }
}
impl<'a> Issued for Magazine<'_> {
    fn get_issue(&self) -> usize {
        self.issue
    }
}
